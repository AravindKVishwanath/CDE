import { useCallback, useEffect, useState } from "react";
import "./App.css";
import Terminal from "./components/terminal";
import FileTree from "./components/tree";
import socket from "./socket";
import AceEditor from "react-ace";
import { getFileMode } from "./utils/getFileMode";

import "ace-builds/src-noconflict/mode-javascript";
import "ace-builds/src-noconflict/theme-dracula";
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
    <div className="app-container">
      <div className="sidebar">
        <div className="sidebar-header">
          <h2>Explorer</h2>
        </div>
        <div className="file-tree-container">
          <FileTree
            onSelect={(path) => {
              setSelectedFileContent("");
              setSelectedFile(path);
            }}
            tree={fileTree}
          />
        </div>
      </div>

      <div className="main-content">
        <div className="editor-header">
          {selectedFile && (
            <div className="file-info">
              <div className="file-path">
                {selectedFile.split('/').map((part, i) => (
                  <span key={i}>
                    {part}
                    {i < selectedFile.split('/').length - 1 && (
                      <span className="path-separator">/</span>
                    )}
                  </span>
                ))}
              </div>
              <div className="file-status">
                <span className={`status-badge ${isSaved ? 'saved' : 'unsaved'}`}>
                  {isSaved ? 'Saved' : 'Unsaved'}
                </span>
                <span className="language-badge">
                  {getFileMode({ selectedFile })}
                </span>
                <button
                  onClick={handleSave}
                  className="save-button"
                  disabled={isSaved}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
                    <polyline points="17 21 17 13 7 13 7 21"></polyline>
                    <polyline points="7 3 7 8 15 8"></polyline>
                  </svg>
                  Save
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="editor-wrapper">
          <AceEditor
            mode={getFileMode({ selectedFile })}
            theme="dracula"
            value={code}
            onChange={(e) => setCode(e)}
            name="code-editor"
            width="100%"
            height="calc(100vh - 180px)"
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
              useWorker: false,
            }}
          />
        </div>

        <div className="terminal-wrapper">
          <Terminal />
        </div>
      </div>
    </div>
  );
}

export default App;