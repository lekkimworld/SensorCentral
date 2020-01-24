import express from 'express';
import * as utils from "../utils";

const router = express.Router()

router.get('/about', (req, res) => {
    res.render('about', Object.assign({
        
    }, utils.buildBaseHandlebarsContext(req)));
})

module.exports = router
