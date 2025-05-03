const http = require('http');
const express = require('express');
const fs = require('fs/promises');
const { spawn } = require('child_process');
const { Server: SocketServer } = require('socket.io');
const path = require('path');
const cors = require('cors');
const chokidar = require('chokidar');

const app = express();
const server = http.createServer(app);
const io = new SocketServer({
    cors: '*'
});

app.use(cors());
io.attach(server);

// 📁 Watch for file changes in /user
chokidar.watch('./user').on('all', (event, path) => {
    io.emit('file:refresh', path);
});

// 🖥️ Start shell using child_process.spawn (cross-platform)
const shell = process.platform === 'win32' ? 'cmd.exe' : 'bash';
const termProcess = spawn("bash", [], {
    cwd: process.cwd() + '/user',
});

// 🔄 Pipe terminal output to socket
termProcess.stdout.on('data', (data) => {
    io.emit('terminal:data', data.toString());
});

termProcess.stderr.on('data', (data) => {
    io.emit('terminal:data', data.toString());
});

termProcess.on('exit', (code) => {
    io.emit('terminal:data', `\nProcess exited with code ${code}\n`);
});

io.on('connection', (socket) => {
    console.log("Socket connected:", socket.id);

    // Emit file refresh event on connection
    socket.emit('file:refresh');

    // Handle file content change
    socket.on('file:change', async ({ path: filePath, content }) => {
        // Define the user folder where files are stored
        const userFolder = path.join(__dirname, 'user');  // Ensure the 'user' folder exists

        // Write the updated content to the specified file inside the user folder
        try {
            await fs.promises.writeFile(path.join(userFolder, filePath), content);
            console.log(`File updated: ${filePath}`);
            socket.emit('file:refresh');  // Notify frontend to refresh file tree
        } catch (error) {
            console.error(`Error writing file ${filePath}:`, error);
            socket.emit('terminal:data', `Error writing file: ${error.message}`);
        }
    });

    // Handle terminal command execution
    socket.on('terminal:write', (command) => {
        console.log("Received command:", command);

        if (!command) {
            console.error("Received empty command, ignoring.");
            return;  // Ignore empty command
        }

        // Define the user folder where commands should be executed
        const userFolder = path.join(__dirname, 'user');  // Ensure the 'user' folder exists

        // Spawn a child process to execute the shell command inside the user folder
        const termProcess = spawn(command, {
            shell: true,
            cwd: userFolder,  // Set the working directory to user folder
        });

        // Send stdout data to the frontend
        termProcess.stdout.on('data', (data) => {
            socket.emit("terminal:data", data.toString());
        });

        // Send stderr data to the frontend (in case of errors)
        termProcess.stderr.on('data', (data) => {
            socket.emit("terminal:data", `Error: ${data.toString()}`);
        });

        // Send process close status to frontend
        termProcess.on('close', (code) => {
            socket.emit("terminal:data", `Process exited with code ${code}`);
        });

        // Handle any issues in starting the child process
        termProcess.on('error', (err) => {
            socket.emit("terminal:data", `Failed to start process: ${err.message}`);
        });
    });
});
// 📁 Endpoint to fetch file tree
app.get('/files', async (req, res) => {
    const fileTree = await generateFileTree('./user');
    return res.json({ tree: fileTree });
});

// 📄 Endpoint to get file content
app.get('/files/content', async (req, res) => {
    const filePath = req.query.path;
    const content = await fs.readFile(`./user${filePath}`, 'utf-8');
    return res.json({ content });
});

server.listen(9000, () => console.log(`🐳 Docker server running on port 9000`));

// 🔁 Recursive file tree generator
async function generateFileTree(directory) {
    const tree = {};

    async function buildTree(currentDir, currentTree) {
        const files = await fs.readdir(currentDir);

        for (const file of files) {
            const filePath = path.join(currentDir, file);
            const stat = await fs.stat(filePath);

            if (stat.isDirectory()) {
                currentTree[file] = {};
                await buildTree(filePath, currentTree[file]);
            } else {
                currentTree[file] = null;
            }
        }
    }

    await buildTree(directory, tree);
    return tree;
}