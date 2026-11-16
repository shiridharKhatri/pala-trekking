declare module "@/vendor/scrollcraft/scrollcraft.js";
interface ScrollCraftInstance { destroy(): void; layout(): void }
interface Window { ScrollCraft?: { mount(root?: Element | string, opts?: object): ScrollCraftInstance; reduce: boolean } }
