const express = require('express')
const xss = require('xss')
const logger = require('../logger')
const BookmarksService = require('./bookmarks-service')

const bkmarkRouter = express.Router()
const bodyParser = express.json()

const xssBookmark = bookmark => ({
    id: bookmark.id,
    title: xss(bookmark.title),
    url: bookmark.url,
    description: xss(bookmark.description),
    rating: Number(bookmark.rating),
})

bkmarkRouter
    .route('/bookmarks')
    .get((req, res, next) => {
        const knexInstance = req.app.get('db')
        BookmarksService.getAllBookmarks(knexInstance)
            .then(bookmarks => {
                res.json(bookmarks.map(xssBookmark))
            })
            .catch(next)
    })
    .post(bodyParser, (req, res, next) => {
        for (const field of ['title', 'url', 'rating']) {
            if (!req.body[field]) {
                logger.error(`${field} is required`)
                return res
                    .status(400)
                    .send({error: {message: `'${field}' is required`}
                })
            }
        }

        const { title, url, rating, description } = req.body;

    
        const numRating = parseFloat(rating)
    
        if (Number.isNaN(numRating) || numRating < 0 || numRating > 5) {
            logger.error(`Invalid rating '${rating}' supplied`);
            return res
                .status(400)
                .send({error: {message: `'rating' must be a number between 0 and 5`}
            })
        }    
    
        const newBookmark = { title, url, rating, description }
    
        BookmarksService.insertBookmark(
            req.app.get('db'),
            newBookmark
        )
        .then(bookmark => {
            logger.info(`Bookmark with id ${bookmark.id} created.`)
            res
                .status(201)
                .location(`/bookmarks/${bookmark.id}`)
                .json(xssBookmark(bookmark))
        })
    .catch(next)
})

bkmarkRouter
    .route('/bookmarks/:bookmark_id')
    .all((req, res, next) => {
        const { bookmark_id } = req.params
        BookmarksService.getById(req.app.get('db'), bookmark_id)
        .then(bookmark => {
            if (!bookmark) {
            logger.error(`Bookmark with id ${bookmark_id} not found.`)
            return res.status(404).json({
                error: { message: `Bookmark not found` }
            })
            }
            res.bookmark = bookmark
            next()
        })
        .catch(next)
    })
    .get((req, res) => {
       res.json(xssBookmark(res.bookmark))
    })
    .delete((req, res, next) => {
        const { bookmark_id } = req.params
        BookmarksService.deleteBookmark(
            req.app.get('db'),
            bookmark_id
        )
        .then(rowsDeleted => {
            logger.info(`Bookmark with id ${bookmark_id} deleted.`)
            res.status(204).end()
        })
        .catch(next)
})

module.exports = bkmarkRouter