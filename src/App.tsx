import "./App.css";
import NeonChat from "./components/neonChat";
import SessionHistory from "./components/sessionHistory";
const App = () => {
  // 初始化 VS Code 实例
  return (
    <div className="App">
      <NeonChat></NeonChat>
      <SessionHistory></SessionHistory>
    </div>
  );
};
export default App;
