import "./App.css";
import NeonChat from "./componnents/neonChat";
import SessionHistory from "./componnents/sessionHistory";
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
