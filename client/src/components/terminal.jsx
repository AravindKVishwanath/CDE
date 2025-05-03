import { useEffect, useRef } from "react";
import socket from "../socket";
import { Terminal as XTerminal } from "@xterm/xterm";
import "@xterm/xterm/css/xterm.css";

const Terminal = () => {
  const terminalRef = useRef();
  const isRendered = useRef(false);
  const currentInput = useRef(""); // Track user input here

  useEffect(() => {
    if (isRendered.current) return;
    isRendered.current = true;

    // Create a new terminal instance
    const term = new XTerminal({
      rows: 20,
      cursorBlink: true,
    });

    // Open the terminal inside the container
    term.open(terminalRef.current);

    // Write an initial message to the terminal
    term.write("$ ");

    // Focus on the terminal to enable user input
    term.focus();

    // Listen for user input
    term.onData((data) => {
      console.log("User pressed:", data);

      if (data === "\r") { // Enter key
        term.write("\r\n"); // Move to the next line

        // Emit the current input to the backend for execution
        console.log("Sending data to backend:", currentInput.current);  // Log the data

        socket.emit("terminal:write", currentInput.current.trim()); // Emit trimmed input

        // Clear the input and reset it for the next command
        currentInput.current = ""; // Reset the current input
        term.write("$ ");
      } else if (data === "\u007f") { // Backspace
        // Simulate backspace in terminal and remove last character from currentInput
        currentInput.current = currentInput.current.slice(0, -1);
        term.write("\b \b");
      } else {
        // Regular key press
        currentInput.current += data; // Accumulate the data into currentInput
        term.write(data);
      }
    });

    // Listen for terminal data from the backend and write it to the terminal
    socket.on('terminal:data', (data) => {
      term.write(data);
    });

  }, []);

  return <div ref={terminalRef} id="terminal" style={{ height: "300px", width: "100%" }} />;
};

export default Terminal;
