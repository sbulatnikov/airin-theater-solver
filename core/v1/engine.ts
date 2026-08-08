import { BaseEngine } from "../shared";
import manifest from "./package.json";

export class Engine extends BaseEngine {
  public constructor(version = manifest.version) {
    super(version);
  }
}

const engine = new Engine();
export default engine;
