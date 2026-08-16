import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);
// static asset dari public/ di root project (bukan relatif bundle temp)
Config.setPublicDir(process.cwd() + "/public");
