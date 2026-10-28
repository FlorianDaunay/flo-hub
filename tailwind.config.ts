import type { Config } from "tailwindcss";
import { tailwindThemeExtension } from "./src/themes/tailwind";

const ext = tailwindThemeExtension();

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      ...ext,
      // Editorial accent face, independent of the theme's own fonts.
      fontFamily: { ...ext.fontFamily, display: ['"Instrument Serif"', "Georgia", "serif"] },
    } as unknown as NonNullable<Config["theme"]>,
  },
} satisfies Config;
