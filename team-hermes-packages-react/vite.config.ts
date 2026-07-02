import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite-plus";

export default defineConfig({
	plugins: [tailwindcss()],
	test: {
		passWithNoTests: true,
	},
	pack: {
		dts: {
			tsgo: true,
		},
		exports: true,
	},
	lint: {
		options: {
			typeAware: true,
			typeCheck: true,
		},
	},
	fmt: {},
});
