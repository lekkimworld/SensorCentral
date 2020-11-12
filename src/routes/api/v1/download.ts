import * as express from 'express';
import { StorageService } from '../../../services/storage-service';
const {lookupService} = require('../../../configure-services');
import {formatDate} from "../../../utils";
import moment from 'moment';

const router = express.Router();

router.get("/power/:downloadKey/:as", async (req, res) => {
    const id = req.params.downloadKey;
    const asType = req.params.as;
	const storage = await lookupService("storage") as StorageService;
	const data = await storage.getTemporaryData(id);
	if (!data) return res.status(404).end();

    if (!asType || asType === "attachment") {
        res.type("application/octet-stream");
        res.setHeader("Content-Disposition", `attachment; filename="powerdata_export_${formatDate(moment(), "YYYYMMDD_HHmm")}.csv"`);
    } else {
        res.type("json");
    }
	res.status(200).send(data);
})

export default router;