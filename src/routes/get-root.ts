import express from 'express';
const router = express.Router();
import * as utils from "../utils";

//@ts-ignore
router.get('/', (req, res) => {
    res.render('root', Object.assign({}, utils.buildBaseHandlebarsContext()));
})

export default router;
