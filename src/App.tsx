import "./App.css";
import NeonChat from "./componnents/neonChat";
const App = () => {
  console.log("App component rendered");
  return (
    <div className="App">
      <NeonChat></NeonChat>
    </div>
  );
};
export default App;
