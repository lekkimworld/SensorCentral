import { getService as _getService } from "../configure-services";
import { BaseService } from "../types";

export const getService = <T extends BaseService>(name: string): T => {
    return _getService<T>(name)!;
};
export default getService;
