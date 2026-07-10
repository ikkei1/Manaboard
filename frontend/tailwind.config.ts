import type { Config } from "tailwindcss";
const config: Config = { content: ["./app/**/*.{js,ts,jsx,tsx}", "./components/**/*.{js,ts,jsx,tsx}"], theme: { extend: { colors: { ink: "#18202f", mist: "#eef3f7", focus: "#2563eb", mint: "#0f9f7a", coral: "#ef6f61" } } }, plugins: [] };
export default config;
