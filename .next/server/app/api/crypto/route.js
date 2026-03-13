/*
 * ATTENTION: An "eval-source-map" devtool has been used.
 * This devtool is neither made for production nor for readable output files.
 * It uses "eval()" calls to create a separate source file with attached SourceMaps in the browser devtools.
 * If you are trying to read the output file, select a different devtool (https://webpack.js.org/configuration/devtool/)
 * or disable the default devtool with "devtool: false".
 * If you are looking for production-ready output files, see mode: "production" (https://webpack.js.org/configuration/mode/).
 */
(() => {
var exports = {};
exports.id = "app/api/crypto/route";
exports.ids = ["app/api/crypto/route"];
exports.modules = {

/***/ "(rsc)/./app/api/crypto/route.ts":
/*!*********************************!*\
  !*** ./app/api/crypto/route.ts ***!
  \*********************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   GET: () => (/* binding */ GET)\n/* harmony export */ });\n/* harmony import */ var next_server__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! next/server */ \"(rsc)/./node_modules/next/dist/api/server.js\");\n\nconst CACHE_TTL = 60 * 1000;\nlet cache = {\n    data: null,\n    ts: 0\n};\nasync function GET() {\n    if (cache.data && Date.now() - cache.ts < CACHE_TTL) {\n        return next_server__WEBPACK_IMPORTED_MODULE_0__.NextResponse.json({\n            source: \"cache\",\n            data: cache.data\n        });\n    }\n    const IDS = [\n        \"bitcoin\",\n        \"ethereum\",\n        \"solana\",\n        \"binancecoin\",\n        \"cardano\",\n        \"avalanche-2\"\n    ].join(\",\");\n    const url = `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${IDS}&order=market_cap_desc&per_page=6&page=1&sparkline=true&price_change_percentage=24h,7d`;\n    try {\n        const res = await fetch(url, {\n            headers: {\n                Accept: \"application/json\"\n            }\n        });\n        if (!res.ok) throw new Error(`CoinGecko ${res.status}`);\n        const data = await res.json();\n        cache = {\n            data,\n            ts: Date.now()\n        };\n        return next_server__WEBPACK_IMPORTED_MODULE_0__.NextResponse.json({\n            source: \"live\",\n            data\n        });\n    } catch (err) {\n        const msg = err instanceof Error ? err.message : \"Unknown error\";\n        return next_server__WEBPACK_IMPORTED_MODULE_0__.NextResponse.json({\n            error: msg\n        }, {\n            status: 500\n        });\n    }\n}\n//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiKHJzYykvLi9hcHAvYXBpL2NyeXB0by9yb3V0ZS50cyIsIm1hcHBpbmdzIjoiOzs7OztBQUEyQztBQUUzQyxNQUFNQyxZQUFZLEtBQUs7QUFDdkIsSUFBSUMsUUFBdUM7SUFBRUMsTUFBTTtJQUFNQyxJQUFJO0FBQUU7QUFFeEQsZUFBZUM7SUFDcEIsSUFBSUgsTUFBTUMsSUFBSSxJQUFJRyxLQUFLQyxHQUFHLEtBQUtMLE1BQU1FLEVBQUUsR0FBR0gsV0FBVztRQUNuRCxPQUFPRCxxREFBWUEsQ0FBQ1EsSUFBSSxDQUFDO1lBQUVDLFFBQVE7WUFBU04sTUFBTUQsTUFBTUMsSUFBSTtRQUFDO0lBQy9EO0lBRUEsTUFBTU8sTUFBTTtRQUFDO1FBQVU7UUFBVztRQUFTO1FBQWM7UUFBVTtLQUFjLENBQUNDLElBQUksQ0FBQztJQUN2RixNQUFNQyxNQUFNLENBQUMsbUVBQW1FLEVBQUVGLElBQUksc0ZBQXNGLENBQUM7SUFFN0ssSUFBSTtRQUNGLE1BQU1HLE1BQU0sTUFBTUMsTUFBTUYsS0FBSztZQUFFRyxTQUFTO2dCQUFFQyxRQUFRO1lBQW1CO1FBQUU7UUFDdkUsSUFBSSxDQUFDSCxJQUFJSSxFQUFFLEVBQUUsTUFBTSxJQUFJQyxNQUFNLENBQUMsVUFBVSxFQUFFTCxJQUFJTSxNQUFNLEVBQUU7UUFDdEQsTUFBTWhCLE9BQU8sTUFBTVUsSUFBSUwsSUFBSTtRQUMzQk4sUUFBUTtZQUFFQztZQUFNQyxJQUFJRSxLQUFLQyxHQUFHO1FBQUc7UUFDL0IsT0FBT1AscURBQVlBLENBQUNRLElBQUksQ0FBQztZQUFFQyxRQUFRO1lBQVFOO1FBQUs7SUFDbEQsRUFBRSxPQUFPaUIsS0FBYztRQUNyQixNQUFNQyxNQUFNRCxlQUFlRixRQUFRRSxJQUFJRSxPQUFPLEdBQUc7UUFDakQsT0FBT3RCLHFEQUFZQSxDQUFDUSxJQUFJLENBQUM7WUFBRWUsT0FBT0Y7UUFBSSxHQUFHO1lBQUVGLFFBQVE7UUFBSTtJQUN6RDtBQUNGIiwic291cmNlcyI6WyIvaG9tZS9QZXRhcktyZXNpbWlyQ3VsaW5hL25leHRqcy1td3FhaHNhZS9hcHAvYXBpL2NyeXB0by9yb3V0ZS50cyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBOZXh0UmVzcG9uc2UgfSBmcm9tIFwibmV4dC9zZXJ2ZXJcIjtcclxuXHJcbmNvbnN0IENBQ0hFX1RUTCA9IDYwICogMTAwMDtcclxubGV0IGNhY2hlOiB7IGRhdGE6IHVua25vd247IHRzOiBudW1iZXIgfSA9IHsgZGF0YTogbnVsbCwgdHM6IDAgfTtcclxuXHJcbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBHRVQoKSB7XHJcbiAgaWYgKGNhY2hlLmRhdGEgJiYgRGF0ZS5ub3coKSAtIGNhY2hlLnRzIDwgQ0FDSEVfVFRMKSB7XHJcbiAgICByZXR1cm4gTmV4dFJlc3BvbnNlLmpzb24oeyBzb3VyY2U6IFwiY2FjaGVcIiwgZGF0YTogY2FjaGUuZGF0YSB9KTtcclxuICB9XHJcblxyXG4gIGNvbnN0IElEUyA9IFtcImJpdGNvaW5cIixcImV0aGVyZXVtXCIsXCJzb2xhbmFcIixcImJpbmFuY2Vjb2luXCIsXCJjYXJkYW5vXCIsXCJhdmFsYW5jaGUtMlwiXS5qb2luKFwiLFwiKTtcclxuICBjb25zdCB1cmwgPSBgaHR0cHM6Ly9hcGkuY29pbmdlY2tvLmNvbS9hcGkvdjMvY29pbnMvbWFya2V0cz92c19jdXJyZW5jeT11c2QmaWRzPSR7SURTfSZvcmRlcj1tYXJrZXRfY2FwX2Rlc2MmcGVyX3BhZ2U9NiZwYWdlPTEmc3BhcmtsaW5lPXRydWUmcHJpY2VfY2hhbmdlX3BlcmNlbnRhZ2U9MjRoLDdkYDtcclxuXHJcbiAgdHJ5IHtcclxuICAgIGNvbnN0IHJlcyA9IGF3YWl0IGZldGNoKHVybCwgeyBoZWFkZXJzOiB7IEFjY2VwdDogXCJhcHBsaWNhdGlvbi9qc29uXCIgfSB9KTtcclxuICAgIGlmICghcmVzLm9rKSB0aHJvdyBuZXcgRXJyb3IoYENvaW5HZWNrbyAke3Jlcy5zdGF0dXN9YCk7XHJcbiAgICBjb25zdCBkYXRhID0gYXdhaXQgcmVzLmpzb24oKTtcclxuICAgIGNhY2hlID0geyBkYXRhLCB0czogRGF0ZS5ub3coKSB9O1xyXG4gICAgcmV0dXJuIE5leHRSZXNwb25zZS5qc29uKHsgc291cmNlOiBcImxpdmVcIiwgZGF0YSB9KTtcclxuICB9IGNhdGNoIChlcnI6IHVua25vd24pIHtcclxuICAgIGNvbnN0IG1zZyA9IGVyciBpbnN0YW5jZW9mIEVycm9yID8gZXJyLm1lc3NhZ2UgOiBcIlVua25vd24gZXJyb3JcIjtcclxuICAgIHJldHVybiBOZXh0UmVzcG9uc2UuanNvbih7IGVycm9yOiBtc2cgfSwgeyBzdGF0dXM6IDUwMCB9KTtcclxuICB9XHJcbn0iXSwibmFtZXMiOlsiTmV4dFJlc3BvbnNlIiwiQ0FDSEVfVFRMIiwiY2FjaGUiLCJkYXRhIiwidHMiLCJHRVQiLCJEYXRlIiwibm93IiwianNvbiIsInNvdXJjZSIsIklEUyIsImpvaW4iLCJ1cmwiLCJyZXMiLCJmZXRjaCIsImhlYWRlcnMiLCJBY2NlcHQiLCJvayIsIkVycm9yIiwic3RhdHVzIiwiZXJyIiwibXNnIiwibWVzc2FnZSIsImVycm9yIl0sImlnbm9yZUxpc3QiOltdLCJzb3VyY2VSb290IjoiIn0=\n//# sourceURL=webpack-internal:///(rsc)/./app/api/crypto/route.ts\n");

/***/ }),

/***/ "(rsc)/./node_modules/next/dist/build/webpack/loaders/next-app-loader/index.js?name=app%2Fapi%2Fcrypto%2Froute&page=%2Fapi%2Fcrypto%2Froute&appPaths=&pagePath=private-next-app-dir%2Fapi%2Fcrypto%2Froute.ts&appDir=%2Fhome%2FPetarKresimirCulina%2Fnextjs-mwqahsae%2Fapp&pageExtensions=tsx&pageExtensions=ts&pageExtensions=jsx&pageExtensions=js&rootDir=%2Fhome%2FPetarKresimirCulina%2Fnextjs-mwqahsae&isDev=true&tsconfigPath=tsconfig.json&basePath=&assetPrefix=&nextConfigOutput=&preferredRegion=&middlewareConfig=e30%3D!":
/*!**************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************!*\
  !*** ./node_modules/next/dist/build/webpack/loaders/next-app-loader/index.js?name=app%2Fapi%2Fcrypto%2Froute&page=%2Fapi%2Fcrypto%2Froute&appPaths=&pagePath=private-next-app-dir%2Fapi%2Fcrypto%2Froute.ts&appDir=%2Fhome%2FPetarKresimirCulina%2Fnextjs-mwqahsae%2Fapp&pageExtensions=tsx&pageExtensions=ts&pageExtensions=jsx&pageExtensions=js&rootDir=%2Fhome%2FPetarKresimirCulina%2Fnextjs-mwqahsae&isDev=true&tsconfigPath=tsconfig.json&basePath=&assetPrefix=&nextConfigOutput=&preferredRegion=&middlewareConfig=e30%3D! ***!
  \**************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   patchFetch: () => (/* binding */ patchFetch),\n/* harmony export */   routeModule: () => (/* binding */ routeModule),\n/* harmony export */   serverHooks: () => (/* binding */ serverHooks),\n/* harmony export */   workAsyncStorage: () => (/* binding */ workAsyncStorage),\n/* harmony export */   workUnitAsyncStorage: () => (/* binding */ workUnitAsyncStorage)\n/* harmony export */ });\n/* harmony import */ var next_dist_server_route_modules_app_route_module_compiled__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! next/dist/server/route-modules/app-route/module.compiled */ \"(rsc)/./node_modules/next/dist/server/route-modules/app-route/module.compiled.js\");\n/* harmony import */ var next_dist_server_route_modules_app_route_module_compiled__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(next_dist_server_route_modules_app_route_module_compiled__WEBPACK_IMPORTED_MODULE_0__);\n/* harmony import */ var next_dist_server_route_kind__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! next/dist/server/route-kind */ \"(rsc)/./node_modules/next/dist/server/route-kind.js\");\n/* harmony import */ var next_dist_server_lib_patch_fetch__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! next/dist/server/lib/patch-fetch */ \"(rsc)/./node_modules/next/dist/server/lib/patch-fetch.js\");\n/* harmony import */ var next_dist_server_lib_patch_fetch__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(next_dist_server_lib_patch_fetch__WEBPACK_IMPORTED_MODULE_2__);\n/* harmony import */ var _home_PetarKresimirCulina_nextjs_mwqahsae_app_api_crypto_route_ts__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ./app/api/crypto/route.ts */ \"(rsc)/./app/api/crypto/route.ts\");\n\n\n\n\n// We inject the nextConfigOutput here so that we can use them in the route\n// module.\nconst nextConfigOutput = \"\"\nconst routeModule = new next_dist_server_route_modules_app_route_module_compiled__WEBPACK_IMPORTED_MODULE_0__.AppRouteRouteModule({\n    definition: {\n        kind: next_dist_server_route_kind__WEBPACK_IMPORTED_MODULE_1__.RouteKind.APP_ROUTE,\n        page: \"/api/crypto/route\",\n        pathname: \"/api/crypto\",\n        filename: \"route\",\n        bundlePath: \"app/api/crypto/route\"\n    },\n    resolvedPagePath: \"/home/PetarKresimirCulina/nextjs-mwqahsae/app/api/crypto/route.ts\",\n    nextConfigOutput,\n    userland: _home_PetarKresimirCulina_nextjs_mwqahsae_app_api_crypto_route_ts__WEBPACK_IMPORTED_MODULE_3__\n});\n// Pull out the exports that we need to expose from the module. This should\n// be eliminated when we've moved the other routes to the new format. These\n// are used to hook into the route.\nconst { workAsyncStorage, workUnitAsyncStorage, serverHooks } = routeModule;\nfunction patchFetch() {\n    return (0,next_dist_server_lib_patch_fetch__WEBPACK_IMPORTED_MODULE_2__.patchFetch)({\n        workAsyncStorage,\n        workUnitAsyncStorage\n    });\n}\n\n\n//# sourceMappingURL=app-route.js.map//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiKHJzYykvLi9ub2RlX21vZHVsZXMvbmV4dC9kaXN0L2J1aWxkL3dlYnBhY2svbG9hZGVycy9uZXh0LWFwcC1sb2FkZXIvaW5kZXguanM/bmFtZT1hcHAlMkZhcGklMkZjcnlwdG8lMkZyb3V0ZSZwYWdlPSUyRmFwaSUyRmNyeXB0byUyRnJvdXRlJmFwcFBhdGhzPSZwYWdlUGF0aD1wcml2YXRlLW5leHQtYXBwLWRpciUyRmFwaSUyRmNyeXB0byUyRnJvdXRlLnRzJmFwcERpcj0lMkZob21lJTJGUGV0YXJLcmVzaW1pckN1bGluYSUyRm5leHRqcy1td3FhaHNhZSUyRmFwcCZwYWdlRXh0ZW5zaW9ucz10c3gmcGFnZUV4dGVuc2lvbnM9dHMmcGFnZUV4dGVuc2lvbnM9anN4JnBhZ2VFeHRlbnNpb25zPWpzJnJvb3REaXI9JTJGaG9tZSUyRlBldGFyS3Jlc2ltaXJDdWxpbmElMkZuZXh0anMtbXdxYWhzYWUmaXNEZXY9dHJ1ZSZ0c2NvbmZpZ1BhdGg9dHNjb25maWcuanNvbiZiYXNlUGF0aD0mYXNzZXRQcmVmaXg9Jm5leHRDb25maWdPdXRwdXQ9JnByZWZlcnJlZFJlZ2lvbj0mbWlkZGxld2FyZUNvbmZpZz1lMzAlM0QhIiwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7O0FBQStGO0FBQ3ZDO0FBQ3FCO0FBQ2lCO0FBQzlGO0FBQ0E7QUFDQTtBQUNBLHdCQUF3Qix5R0FBbUI7QUFDM0M7QUFDQSxjQUFjLGtFQUFTO0FBQ3ZCO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsS0FBSztBQUNMO0FBQ0E7QUFDQSxZQUFZO0FBQ1osQ0FBQztBQUNEO0FBQ0E7QUFDQTtBQUNBLFFBQVEsc0RBQXNEO0FBQzlEO0FBQ0EsV0FBVyw0RUFBVztBQUN0QjtBQUNBO0FBQ0EsS0FBSztBQUNMO0FBQzBGOztBQUUxRiIsInNvdXJjZXMiOlsiIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IEFwcFJvdXRlUm91dGVNb2R1bGUgfSBmcm9tIFwibmV4dC9kaXN0L3NlcnZlci9yb3V0ZS1tb2R1bGVzL2FwcC1yb3V0ZS9tb2R1bGUuY29tcGlsZWRcIjtcbmltcG9ydCB7IFJvdXRlS2luZCB9IGZyb20gXCJuZXh0L2Rpc3Qvc2VydmVyL3JvdXRlLWtpbmRcIjtcbmltcG9ydCB7IHBhdGNoRmV0Y2ggYXMgX3BhdGNoRmV0Y2ggfSBmcm9tIFwibmV4dC9kaXN0L3NlcnZlci9saWIvcGF0Y2gtZmV0Y2hcIjtcbmltcG9ydCAqIGFzIHVzZXJsYW5kIGZyb20gXCIvaG9tZS9QZXRhcktyZXNpbWlyQ3VsaW5hL25leHRqcy1td3FhaHNhZS9hcHAvYXBpL2NyeXB0by9yb3V0ZS50c1wiO1xuLy8gV2UgaW5qZWN0IHRoZSBuZXh0Q29uZmlnT3V0cHV0IGhlcmUgc28gdGhhdCB3ZSBjYW4gdXNlIHRoZW0gaW4gdGhlIHJvdXRlXG4vLyBtb2R1bGUuXG5jb25zdCBuZXh0Q29uZmlnT3V0cHV0ID0gXCJcIlxuY29uc3Qgcm91dGVNb2R1bGUgPSBuZXcgQXBwUm91dGVSb3V0ZU1vZHVsZSh7XG4gICAgZGVmaW5pdGlvbjoge1xuICAgICAgICBraW5kOiBSb3V0ZUtpbmQuQVBQX1JPVVRFLFxuICAgICAgICBwYWdlOiBcIi9hcGkvY3J5cHRvL3JvdXRlXCIsXG4gICAgICAgIHBhdGhuYW1lOiBcIi9hcGkvY3J5cHRvXCIsXG4gICAgICAgIGZpbGVuYW1lOiBcInJvdXRlXCIsXG4gICAgICAgIGJ1bmRsZVBhdGg6IFwiYXBwL2FwaS9jcnlwdG8vcm91dGVcIlxuICAgIH0sXG4gICAgcmVzb2x2ZWRQYWdlUGF0aDogXCIvaG9tZS9QZXRhcktyZXNpbWlyQ3VsaW5hL25leHRqcy1td3FhaHNhZS9hcHAvYXBpL2NyeXB0by9yb3V0ZS50c1wiLFxuICAgIG5leHRDb25maWdPdXRwdXQsXG4gICAgdXNlcmxhbmRcbn0pO1xuLy8gUHVsbCBvdXQgdGhlIGV4cG9ydHMgdGhhdCB3ZSBuZWVkIHRvIGV4cG9zZSBmcm9tIHRoZSBtb2R1bGUuIFRoaXMgc2hvdWxkXG4vLyBiZSBlbGltaW5hdGVkIHdoZW4gd2UndmUgbW92ZWQgdGhlIG90aGVyIHJvdXRlcyB0byB0aGUgbmV3IGZvcm1hdC4gVGhlc2Vcbi8vIGFyZSB1c2VkIHRvIGhvb2sgaW50byB0aGUgcm91dGUuXG5jb25zdCB7IHdvcmtBc3luY1N0b3JhZ2UsIHdvcmtVbml0QXN5bmNTdG9yYWdlLCBzZXJ2ZXJIb29rcyB9ID0gcm91dGVNb2R1bGU7XG5mdW5jdGlvbiBwYXRjaEZldGNoKCkge1xuICAgIHJldHVybiBfcGF0Y2hGZXRjaCh7XG4gICAgICAgIHdvcmtBc3luY1N0b3JhZ2UsXG4gICAgICAgIHdvcmtVbml0QXN5bmNTdG9yYWdlXG4gICAgfSk7XG59XG5leHBvcnQgeyByb3V0ZU1vZHVsZSwgd29ya0FzeW5jU3RvcmFnZSwgd29ya1VuaXRBc3luY1N0b3JhZ2UsIHNlcnZlckhvb2tzLCBwYXRjaEZldGNoLCAgfTtcblxuLy8jIHNvdXJjZU1hcHBpbmdVUkw9YXBwLXJvdXRlLmpzLm1hcCJdLCJuYW1lcyI6W10sImlnbm9yZUxpc3QiOltdLCJzb3VyY2VSb290IjoiIn0=\n//# sourceURL=webpack-internal:///(rsc)/./node_modules/next/dist/build/webpack/loaders/next-app-loader/index.js?name=app%2Fapi%2Fcrypto%2Froute&page=%2Fapi%2Fcrypto%2Froute&appPaths=&pagePath=private-next-app-dir%2Fapi%2Fcrypto%2Froute.ts&appDir=%2Fhome%2FPetarKresimirCulina%2Fnextjs-mwqahsae%2Fapp&pageExtensions=tsx&pageExtensions=ts&pageExtensions=jsx&pageExtensions=js&rootDir=%2Fhome%2FPetarKresimirCulina%2Fnextjs-mwqahsae&isDev=true&tsconfigPath=tsconfig.json&basePath=&assetPrefix=&nextConfigOutput=&preferredRegion=&middlewareConfig=e30%3D!\n");

/***/ }),

/***/ "(rsc)/./node_modules/next/dist/build/webpack/loaders/next-flight-client-entry-loader.js?server=true!":
/*!******************************************************************************************************!*\
  !*** ./node_modules/next/dist/build/webpack/loaders/next-flight-client-entry-loader.js?server=true! ***!
  \******************************************************************************************************/
/***/ (() => {



/***/ }),

/***/ "(ssr)/./node_modules/next/dist/build/webpack/loaders/next-flight-client-entry-loader.js?server=true!":
/*!******************************************************************************************************!*\
  !*** ./node_modules/next/dist/build/webpack/loaders/next-flight-client-entry-loader.js?server=true! ***!
  \******************************************************************************************************/
/***/ (() => {



/***/ }),

/***/ "../app-render/after-task-async-storage.external":
/*!***********************************************************************************!*\
  !*** external "next/dist/server/app-render/after-task-async-storage.external.js" ***!
  \***********************************************************************************/
/***/ ((module) => {

"use strict";
module.exports = require("next/dist/server/app-render/after-task-async-storage.external.js");

/***/ }),

/***/ "../app-render/work-async-storage.external":
/*!*****************************************************************************!*\
  !*** external "next/dist/server/app-render/work-async-storage.external.js" ***!
  \*****************************************************************************/
/***/ ((module) => {

"use strict";
module.exports = require("next/dist/server/app-render/work-async-storage.external.js");

/***/ }),

/***/ "./work-unit-async-storage.external":
/*!**********************************************************************************!*\
  !*** external "next/dist/server/app-render/work-unit-async-storage.external.js" ***!
  \**********************************************************************************/
/***/ ((module) => {

"use strict";
module.exports = require("next/dist/server/app-render/work-unit-async-storage.external.js");

/***/ }),

/***/ "next/dist/compiled/next-server/app-page.runtime.dev.js":
/*!*************************************************************************!*\
  !*** external "next/dist/compiled/next-server/app-page.runtime.dev.js" ***!
  \*************************************************************************/
/***/ ((module) => {

"use strict";
module.exports = require("next/dist/compiled/next-server/app-page.runtime.dev.js");

/***/ }),

/***/ "next/dist/compiled/next-server/app-route.runtime.dev.js":
/*!**************************************************************************!*\
  !*** external "next/dist/compiled/next-server/app-route.runtime.dev.js" ***!
  \**************************************************************************/
/***/ ((module) => {

"use strict";
module.exports = require("next/dist/compiled/next-server/app-route.runtime.dev.js");

/***/ })

};
;

// load runtime
var __webpack_require__ = require("../../../webpack-runtime.js");
__webpack_require__.C(exports);
var __webpack_exec__ = (moduleId) => (__webpack_require__(__webpack_require__.s = moduleId))
var __webpack_exports__ = __webpack_require__.X(0, ["vendor-chunks/next"], () => (__webpack_exec__("(rsc)/./node_modules/next/dist/build/webpack/loaders/next-app-loader/index.js?name=app%2Fapi%2Fcrypto%2Froute&page=%2Fapi%2Fcrypto%2Froute&appPaths=&pagePath=private-next-app-dir%2Fapi%2Fcrypto%2Froute.ts&appDir=%2Fhome%2FPetarKresimirCulina%2Fnextjs-mwqahsae%2Fapp&pageExtensions=tsx&pageExtensions=ts&pageExtensions=jsx&pageExtensions=js&rootDir=%2Fhome%2FPetarKresimirCulina%2Fnextjs-mwqahsae&isDev=true&tsconfigPath=tsconfig.json&basePath=&assetPrefix=&nextConfigOutput=&preferredRegion=&middlewareConfig=e30%3D!")));
module.exports = __webpack_exports__;

})();