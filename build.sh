npm run package -- --platform=win32 --arch=x64
npm run package -- --platform=linux --arch=x64
npm run make
electron-builder -l deb
electron-builder -wl