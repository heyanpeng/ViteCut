import { createRoot } from "react-dom/client";
import "@radix-ui/themes/styles.css";
import "./index.css";
import App from "@/App";

const projectInfo = "Vite-Cut 在线视频剪辑工具";
const contact = "Email: heyanpeng91@gmail.com | GitHub: @heyanpeng";

console.log(
  `%c ${projectInfo} %c ${contact} `,
  "color: white; background: #3f63de; padding: 4px; border-radius: 4px; font-weight: bold;",
  "color: #3f63de; background: #ffffff; padding: 4px; border-radius: 4px;"
);

createRoot(document.getElementById("root")!).render(<App />);
