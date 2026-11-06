/* Intentionally no site-wide middleware. API requests must not change static page caching. */
export const onRequest = ({next}) => next();
