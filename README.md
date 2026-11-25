# Keeper

A local-first browser dashboard for collections of website shortcuts.

## Project structure

```text
src/
  main.tsx                    React entry point
  styles/global.css           Global design system and layout styles
  app/App.tsx                 App state and screen composition
  features/
    collections/              Collection model, navigation, grid, and cards
    settings/                 Preferences model and appearance settings
```

## Development

```sh
npm install
npm run dev
```

`npm run build` runs strict TypeScript checking before creating the production bundle. `npm run preview` serves the built bundle locally.

Collections, shortcuts, and appearance preferences are stored in browser local storage.
