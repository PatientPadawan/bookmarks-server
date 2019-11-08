const path = require('path')
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
    .route('/')

    .get((req, res, next) => {
        const knexInstance = req.app.get('db')
        BookmarksService.getAllBookmarks(knexInstance)
            .then(bookmarks => {
                res.json(bookmarks.map(xssBookmark))
            })
            .catch(next)
    })

    .post(bodyParser, (req, res, next) => {
        const { title, url, rating, description } = req.body;
        const newBookmark = { title, url, rating, description }

        for (const field of ['title', 'url', 'rating']) {
            if (!req.body[field]) {
                logger.error(`${field} is required`)
                return res
                    .status(400)
                    .send({error: {message: `'${field}' is required`}
                })
            }
        }
    
        const numRating = parseFloat(rating)
    
        if (Number.isNaN(numRating) || numRating < 0 || numRating > 5) {
            logger.error(`Invalid rating '${rating}' supplied`);
            return res
                .status(400)
                .send({error: {message: `'rating' must be a number between 0 and 5`}
            })
        }    
    
        BookmarksService.insertBookmark(
            req.app.get('db'),
            newBookmark
        )
        .then(bookmark => {
            logger.info(`Bookmark with id ${bookmark.id} created.`)
            res
                .status(201)
                .location(path.posix.join(req.originalUrl, `/${bookmark.id}`))
                .json(xssBookmark(bookmark))
        })
    .catch(next)
})

bkmarkRouter
    .route('/:bookmark_id')

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

    .patch(bodyParser, (req, res, next) => {
        const { title, url, description, rating } = req.body
        const bookmarkToUpdate = { title, url, description, rating } 

        const numberOfValues = Object.values(bookmarkToUpdate).filter(Boolean).length
        if (numberOfValues === 0) {
            logger.error('Invalid update without required fields')
            return res
                .status(400)
                .json({
                    error: {
                        message: `Request body must contain either 'title', 'url', 'description', or 'rating'`
                    }
                })
        }

        if (rating &&
            (!Number.isInteger(rating) || rating < 0 || rating > 5)) {
                logger.error(`Invalid rating '${rating}' supplied`);
                return res
                    .status(400)
                    .send({error: {message: `'rating' must be a number between 0 and 5`}
                })
        }

        BookmarksService.updateBookmark(
            req.app.get('db'),
            req.params.bookmark_id,
            bookmarkToUpdate
        )
        .then(numRowsAffected => {res.status(204).end()})
        .catch(next)
    })

module.exports = bkmarkRouter