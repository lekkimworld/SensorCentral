//@ts-ignore
import {getService as getJavascriptService} from "../configure-services";
import { BaseService } from "../types";

export const getService = <T extends BaseService> (name: string) : T => {
    return getJavascriptService(name);
}
export default getService;
