import express from 'express';
const router = express.Router()
import * as utils from "../utils";

router.get('/', (req, res) => {
    res.render('root', Object.assign({}, utils.buildBaseHandlebarsContext(req)));
})

module.exports = router
