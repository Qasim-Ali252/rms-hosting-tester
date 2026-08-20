const { io } = require("socket.io-client");
const socket = io("http://localhost:3001", { reconnectionAttempts: 3 });

socket.on("connect", () => {
  console.log("connected", socket.id);
  socket.emit("test-message", { text: "hello from node" });
});

socket.on("test-response", (data) => {
  console.log("test-response:", data);
  socket.disconnect();
});

socket.on("connect_error", (err) => {
  console.error("connect_error:", err.message);
});