import { useCallback, useEffect, useState } from "react";
import "./App.css";
import Terminal from "./components/terminal";
import FileTree from "./components/tree";
import socket from "./socket";
import AceEditor from "react-ace";

import { getFileMode } from "./utils/getFileMode";

import "ace-builds/src-noconflict/mode-javascript";
import "ace-builds/src-noconflict/theme-github";
import "ace-builds/src-noconflict/ext-language_tools";

function App() {
  const [fileTree, setFileTree] = useState({});
  const [selectedFile, setSelectedFile] = useState("");
  const [selectedFileContent, setSelectedFileContent] = useState("");
  const [code, setCode] = useState("");

  const isSaved = selectedFileContent === code;

  useEffect(() => {
    if (!isSaved && code) {
      const timer = setTimeout(() => {
        socket.emit("file:change", {
          path: selectedFile,
          content: code,
        });
      }, 5 * 1000);
      return () => {
        clearTimeout(timer);
      };
    }
  }, [code, selectedFile, isSaved]);

  useEffect(() => {
    setCode("");
  }, [selectedFile]);

  useEffect(() => {
    setCode(selectedFileContent);
  }, [selectedFileContent]);

  const getFileTree = async () => {
    const response = await fetch("http://localhost:9000/files");
    const result = await response.json();
    setFileTree(result.tree);
  };

  const getFileContents = useCallback(async () => {
    if (!selectedFile) return;
    const response = await fetch(
      `http://localhost:9000/files/content?path=${selectedFile}`
    );
    const result = await response.json();
    setSelectedFileContent(result.content);
  }, [selectedFile]);

  useEffect(() => {
    if (selectedFile) getFileContents();
  }, [getFileContents, selectedFile]);

  useEffect(() => {
    socket.on("file:refresh", getFileTree);
    return () => {
      socket.off("file:refresh", getFileTree);
    };
  }, []);
  const handleSave = () => {
    if (!selectedFile) return;
  
    socket.emit('file:change', {
      path: selectedFile,
      content: code,
    });
  
    setSelectedFileContent(code);
  };
  

  return (
    <div className="playground-container">
      <div className="editor-container">
        <div className="files">
          <FileTree
            onSelect={(path) => {
              setSelectedFileContent("");
              setSelectedFile(path);
            }}
            tree={fileTree}
          />
        </div>
        <div className="editor">
          {selectedFile && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <p>
                {selectedFile.replaceAll("/", " > ")} —{" "}
                <span style={{ color: isSaved ? "green" : "red" }}>
                  {isSaved ? "Saved" : "Unsaved"}
                </span>
              </p>
              <button
                onClick={handleSave}
                style={{
                  padding: '6px 12px',
                  backgroundColor: '#007bff',
                  color: 'white',
                  border: 'none',
                  borderRadius: '5px',
                  cursor: 'pointer',
                }}
              >
                Save
              </button>
            </div>
          )}
          <AceEditor
            mode={getFileMode({ selectedFile })}
            theme="monokai"              // or 'github', 'dracula', etc.
            value={code}
            onChange={(e) => setCode(e)}
            name="code-editor"
            width="100%"
            height="400px"              // adjustable
            fontSize={14}
            showPrintMargin={false}
            showGutter={true}
            highlightActiveLine={true}
            setOptions={{
              enableBasicAutocompletion: true,
              enableLiveAutocompletion: true,
              enableSnippets: true,
              showLineNumbers: true,
              tabSize: 2,
              useWorker: false, // Disable web worker to avoid some warnings
            }}
          />
        </div>
        
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-evenly', alignItems: 'center' }}>
          <h3>Editing: {selectedFile}</h3>
          <span style={{
            backgroundColor: "grey",
            padding: '4px 10px',
            borderRadius: '8px',
            fontSize: '18px',
            fontWeight: 'bold'
          }}>
            {getFileMode({ selectedFile })}
          </span>
        </div>
      <div className="terminal-container">
        <Terminal />
      </div>
    </div>
  );
}

export default App;
