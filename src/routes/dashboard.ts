import express from 'express';
import * as utils from "../utils";

const router = express.Router()

router.get('/', (req, res) => {
    res.render('dashboard', Object.assign({}, utils.buildBaseHandlebarsContext(req)));
})

export default router;
