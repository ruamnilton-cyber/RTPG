export type PaletteDefinition = {
  id: string;
  name: string;
  description: string;
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    surface: string;
    surfaceAlt: string;
    menu: string;
    text: string;
    muted: string;
    border: string;
    badge: string;
  };
};

export const palettes: PaletteDefinition[] = [
  {
    id: "preto-dourado-grafite",
    name: "Preto + Dourado + Grafite",
    description: "Clássico premium para bares sofisticados.",
    colors: { primary: "#c99a2e", secondary: "#f3e1a8", accent: "#f4c857", background: "#0f0f10", surface: "#1b1b1f", surfaceAlt: "#24252b", menu: "#111214", text: "#f9f3e4", muted: "#b8b0a1", border: "#3a3a40", badge: "#2e2a1a" }
  },
  {
    id: "verde-bege-marrom",
    name: "Verde Escuro + Bege + Marrom",
    description: "Acolhedor e gastronômico.",
    colors: { primary: "#2d4f3a", secondary: "#dccfb1", accent: "#8d6743", background: "#f4efe6", surface: "#fffaf2", surfaceAlt: "#ede4d4", menu: "#243e2e", text: "#1f291f", muted: "#6d715f", border: "#d0c0aa", badge: "#e4d7bf" }
  },
  {
    id: "bordo-preto-offwhite",
    name: "Vinho/Bordô + Preto + Off-white",
    description: "Noturno, elegante e forte.",
    colors: { primary: "#6f1730", secondary: "#131115", accent: "#b04363", background: "#f7f3f1", surface: "#fffdfb", surfaceAlt: "#f0e7e2", menu: "#190e13", text: "#25171c", muted: "#7b6770", border: "#e0d2cd", badge: "#f1e2e3" }
  },
  {
    id: "azul-branco-dourado",
    name: "Azul Marinho + Branco + Dourado",
    description: "Visual limpo e refinado.",
    colors: { primary: "#133d68", secondary: "#fefefe", accent: "#d4a93e", background: "#eef4fa", surface: "#ffffff", surfaceAlt: "#dfe9f4", menu: "#0f2f4f", text: "#102133", muted: "#607384", border: "#c7d7e7", badge: "#e3edf6" }
  },
  {
    id: "terracota-creme-oliva",
    name: "Terracota + Creme + Verde Oliva",
    description: "Quente, artesanal e moderno.",
    colors: { primary: "#b45a3c", secondary: "#fbf2df", accent: "#6b7b43", background: "#f8f1e6", surface: "#fffaf4", surfaceAlt: "#efe5d3", menu: "#7f412d", text: "#32241b", muted: "#7f6d5d", border: "#d9c7b2", badge: "#ede2cf" }
  },
  {
    id: "chumbo-laranja-branco",
    name: "Cinza Chumbo + Laranja Queimado + Branco",
    description: "SaaS contemporâneo com energia.",
    colors: { primary: "#30353d", secondary: "#ffffff", accent: "#d66a2c", background: "#f4f5f7", surface: "#ffffff", surfaceAlt: "#eceff2", menu: "#25292f", text: "#171a1f", muted: "#68707a", border: "#d7dce2", badge: "#eef1f5" }
  },
  {
    id: "preto-vermelho-cinza",
    name: "Preto + Vermelho Escuro + Cinza",
    description: "Impactante e urbano.",
    colors: { primary: "#7b1025", secondary: "#111111", accent: "#cf445d", background: "#f3f3f4", surface: "#ffffff", surfaceAlt: "#e7e7ea", menu: "#171719", text: "#1b1b1d", muted: "#666871", border: "#d8d8dd", badge: "#efeff2" }
  },
  {
    id: "madeira-caramelo-bege",
    name: "Madeira/Caramelo + Preto + Bege",
    description: "Aconchegante com cara de casa premium.",
    colors: { primary: "#8f5f31", secondary: "#16120e", accent: "#d0a164", background: "#f4ead8", surface: "#fffaf2", surfaceAlt: "#eadcc7", menu: "#2b1b11", text: "#2c2218", muted: "#7a6754", border: "#d9c3aa", badge: "#efe2cf" }
  }
];

export const paletteMap = Object.fromEntries(palettes.map((palette) => [palette.id, palette])) as Record<string, PaletteDefinition>;
