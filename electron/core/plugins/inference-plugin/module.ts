const path = require("path");
const { app } = require("electron");
const { spawn } = require("child_process");
const fs = require("fs");
const tcpPortUsed = require("tcp-port-used");
const { killPortProcess } = require("kill-port-process");

let subprocess = null;
const PORT = 3928;

const initModel = (fileName) => {
  return (
    new Promise<void>(async (resolve, reject) => {
      if (!fileName) {
        reject("Model not found, please download again.");
      }
      if (subprocess) {
        console.error(
          "A subprocess is already running. Attempt to kill then reinit."
        );
        killSubprocess();
      }
      resolve(fileName);
    })
      // Kill port process if it is already in use
      .then((fileName) =>
        tcpPortUsed
          .waitUntilFree(PORT, 200, 3000)
          .catch(() => killPortProcess(PORT))
          .then(() => fileName)
      )
      // Spawn Nitro subprocess to load model
      .then(() => {
        let binaryFolder = path.join(__dirname, "nitro"); // Current directory by default

        // Read the existing config
        const configFilePath = path.join(binaryFolder, "config", "config.json");
        let config: any = {};
        if (fs.existsSync(configFilePath)) {
          const rawData = fs.readFileSync(configFilePath, "utf-8");
          config = JSON.parse(rawData);
        }

        // Update the llama_model_path
        if (!config.custom_config) {
          config.custom_config = {};
        }

        const modelPath = path.join(app.getPath("userData"), fileName);

        config.custom_config.llama_model_path = modelPath;

        // Write the updated config back to the file
        fs.writeFileSync(configFilePath, JSON.stringify(config, null, 4));

        let binaryName;

        if (process.platform === "win32") {
          binaryName = "nitro_windows_amd64.exe";
        } else if (process.platform === "darwin") {
          // Mac OS platform
          binaryName =
            process.arch === "arm64" ? "nitro_mac_arm64" : "nitro_mac_amd64";
        } else {
          // Linux
          binaryName = "nitro_linux_amd64_cuda"; // For other platforms
        }

        const binaryPath = path.join(binaryFolder, binaryName);

        // Execute the binary

        subprocess = spawn(binaryPath, [configFilePath], { cwd: binaryFolder });

        // Handle subprocess output
        subprocess.stdout.on("data", (data) => {
          console.log(`stdout: ${data}`);
        });

        subprocess.stderr.on("data", (data) => {
          console.error(`stderr: ${data}`);
        });

        subprocess.on("close", (code) => {
          console.log(`child process exited with code ${code}`);
          subprocess = null;
        });
      })
      .then(() => tcpPortUsed.waitUntilUsed(PORT, 300, 30000))
      .then(() => {
        return {};
      })
      .catch((err) => {
        return { error: err };
      })
  );
};

function dispose() {
  killSubprocess();
  // clean other registered resources here
}

function killSubprocess() {
  if (subprocess) {
    subprocess.kill();
    subprocess = null;
    console.log("Subprocess terminated.");
  } else {
    killPortProcess(PORT);
    console.error("No subprocess is currently running.");
  }
}

module.exports = {
  initModel,
  killSubprocess,
  dispose,
};
