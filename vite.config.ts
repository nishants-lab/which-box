import react from '@vitejs/plugin-react';
import {defineConfig} from 'vite';
export default defineConfig({base:'./',plugins:[react()],build:{target:'es2022'},server:{host:'127.0.0.1'}});
