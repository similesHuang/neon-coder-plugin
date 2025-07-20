import { useEffect, useState } from "react";
import "./App.css";
const App = () => {
  const [message, setMessage] = useState("Loading...");
  useEffect(() => {
    const fetchData = async () => {
      try {
        // 直接使用固定地址
        const response = await fetch("http://localhost:3002/api/hello");

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        setMessage(data.message);
      } catch (error) {
        console.error("Error fetching data:", error);
        setMessage(
          `Error: ${error instanceof Error ? error.message : "Failed to fetch"}`
        );
      }
    };

    fetchData();
  }, []);

  return <div className="App">{message}</div>;
};
export default App;
