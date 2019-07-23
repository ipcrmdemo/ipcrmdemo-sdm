import { MvnPackage, MvnVersion } from "@atomist/sdm-pack-spring";
import { GoalCacheOptions } from "@atomist/sdm-core";
import { NpmInstallProjectListener } from "@atomist/sdm-pack-node";

/**
 * Cache Definitions
 */
export const mavenJarCache: GoalCacheOptions = {
  entries: [{classifier: "jars", pattern: {globPattern: "**/target/*.jar"}}],
  onCacheMiss: [MvnVersion, MvnPackage],
};
export const NodeModulesCacheOptions: GoalCacheOptions = {
  entries: [{ classifier: "nodeModules", pattern: { directory: "node_modules" }}],
  onCacheMiss: [NpmInstallProjectListener],
};
