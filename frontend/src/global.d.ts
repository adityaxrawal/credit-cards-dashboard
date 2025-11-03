// Global type declarations for CSS and other module imports

// For CSS module files (with .module.css extension)
declare module "*.module.css" {
  const classes: { [key: string]: string };
  export default classes;
}

declare module "*.module.scss" {
  const classes: { [key: string]: string };
  export default classes;
}

declare module "*.module.sass" {
  const classes: { [key: string]: string };
  export default classes;
}

// For regular CSS files imported as side effects (like "./globals.css")
declare module "*.css";
declare module "*.scss";
declare module "*.sass";
