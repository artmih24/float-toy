npm run package -- --platform=win32 --arch=x64 && npm run package -- --platform=linux --arch=x64 && npm run package -- --platform=darwin --arch=arm64 && npm run make && electron-builder -wl
