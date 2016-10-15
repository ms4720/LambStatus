import webpackConfig from '../build/webpack.config'
import config from '../config'

config.utils_paths.entry_point = config.utils_paths.client('status-page.js')

// Pages for general users should not contain api info.
delete config.globals['__API_URL__']
delete config.globals['__API_KEY__']

config.utils_paths.dist = config.utils_paths.dist('status-page')

export default webpackConfig(config)
