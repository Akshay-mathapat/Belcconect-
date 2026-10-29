process.env.NODE_ENV = process.env.NODE_ENV || "test";
process.env.BELCONNECT_TEST_MODE = "1";
process.env.CSRF_ALLOW_DEV_ORIGINS = process.env.CSRF_ALLOW_DEV_ORIGINS || "1";
import { register } from "node:module";
register("./node-ts-resolver.mjs", import.meta.url);


