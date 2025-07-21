import { useEffect, useState } from "react";
import "./App.css";
import { callApi } from "./hooks/useApi";
const App = () => {
  const [message, setMessage] = useState("Loading...");
  console.log("App component rendered");
  useEffect(() => {
    callApi("/api/hello", "GET").then((res) => {
      setMessage(JSON.stringify(res?.data));
    });
  }, []);

  return <div className="App">{message}</div>;
};
export default App;
