import type { Config } from "tailwindcss";

/** Canales HSL con comas + hsla() para Safari < 15 (sin sintaxis `hsl(H S% L% / a)`). */
const hsla = (channel: string) => `hsla(var(${channel}), <alpha-value>)`;

export default {
	darkMode: ["class"],
	content: [
		"./pages/**/*.{ts,tsx}",
		"./components/**/*.{ts,tsx}",
		"./app/**/*.{ts,tsx}",
		"./src/**/*.{ts,tsx}",
	],
	prefix: "",
	theme: {
		container: {
			center: true,
			padding: '2rem',
			screens: {
				'2xl': '1400px'
			}
		},
		extend: {
			colors: {
				border: hsla('--border'),
				input: hsla('--input'),
				ring: hsla('--ring'),
				background: hsla('--background'),
				foreground: hsla('--foreground'),
				primary: {
					DEFAULT: hsla('--primary'),
					foreground: hsla('--primary-foreground')
				},
				secondary: {
					DEFAULT: hsla('--secondary'),
					foreground: hsla('--secondary-foreground')
				},
				destructive: {
					DEFAULT: hsla('--destructive'),
					foreground: hsla('--destructive-foreground')
				},
				muted: {
					DEFAULT: hsla('--muted'),
					foreground: hsla('--muted-foreground')
				},
				accent: {
					DEFAULT: hsla('--accent'),
					foreground: hsla('--accent-foreground')
				},
				popover: {
					DEFAULT: hsla('--popover'),
					foreground: hsla('--popover-foreground')
				},
				card: {
					DEFAULT: hsla('--card'),
					foreground: hsla('--card-foreground')
				},
				sidebar: {
					DEFAULT: hsla('--sidebar-background'),
					foreground: hsla('--sidebar-foreground'),
					primary: hsla('--sidebar-primary'),
					'primary-foreground': hsla('--sidebar-primary-foreground'),
					accent: hsla('--sidebar-accent'),
					'accent-foreground': hsla('--sidebar-accent-foreground'),
					border: hsla('--sidebar-border'),
					ring: hsla('--sidebar-ring')
				}
			},
			borderRadius: {
				lg: 'var(--radius)',
				md: 'calc(var(--radius) - 2px)',
				sm: 'calc(var(--radius) - 4px)'
			},
			keyframes: {
				'accordion-down': {
					from: {
						height: '0'
					},
					to: {
						height: 'var(--radix-accordion-content-height)'
					}
				},
				'accordion-up': {
					from: {
						height: 'var(--radix-accordion-content-height)'
					},
					to: {
						height: '0'
					}
				}
			},
			animation: {
				'accordion-down': 'accordion-down 0.2s ease-out',
				'accordion-up': 'accordion-up 0.2s ease-out'
			}
		}
	},
	plugins: [require("tailwindcss-animate")],
} satisfies Config;
