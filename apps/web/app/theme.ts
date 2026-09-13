import {
  createTheme,
  type CSSVariablesResolver,
  type MantineColorsTuple,
} from "@mantine/core";

// Product palette shared by the admin workspace, chat and public agent pages.
// It mirrors the landing page while keeping semantic red/green colors intact.
const sage: MantineColorsTuple = [
  "#f7f9f4",
  "#edf2e5",
  "#dce4d7",
  "#cbd5c3",
  "#b9cfab",
  "#9eb88a",
  "#7e9a67",
  "#658953",
  "#3b5943",
  "#243c30",
];

const warmGray: MantineColorsTuple = [
  "#fafbf6",
  "#f7f9f4",
  "#edf2e5",
  "#dce4d7",
  "#c4cdbd",
  "#9aa89d",
  "#7a8b80",
  "#617165",
  "#3b5144",
  "#243c30",
];

const terracotta: MantineColorsTuple = [
  "#fbf2ef",
  "#f6e2dc",
  "#edc2b6",
  "#dfa08e",
  "#cf7f69",
  "#c3664e",
  "#b6573d",
  "#9e4733",
  "#833b2c",
  "#6d3328",
];

export const theme = createTheme({
  colors: { sage, gray: warmGray, terracotta },
  primaryColor: "sage",
  primaryShade: 9,
  black: "#243c30",
  white: "#ffffff",
  defaultRadius: "md",
  focusRing: "auto",
});

export const cssVariablesResolver: CSSVariablesResolver = () => ({
  variables: {
    "--mantine-color-body": "#fafbf6",
    "--mantine-color-text": "#243c30",
    "--mantine-color-dimmed": "#617165",
    "--mantine-color-default": "#ffffff",
    "--mantine-color-default-hover": "#f7f9f4",
    "--mantine-color-default-border": "#dce4d7",
  },
  light: {},
  dark: {},
});
