'use strict';

var gulp = require('gulp');
var stylus = require('gulp-stylus');
var sourcemaps = require('gulp-sourcemaps');
var gulpIf = require('gulp-if');
var del = require('del');
var run = require('run-sequence');
var cached = require('gulp-cached');
var newer = require('gulp-newer');
var browserSync = require('browser-sync').create();
var reload = browserSync.reload;
var notify = require('gulp-notify');
var plumber = require('gulp-plumber');
var uglify = require('gulp-uglify');
var cssnano  = require('gulp-cssnano');
var rev = require('gulp-rev');
var revReplace = require('gulp-rev-replace');

var webpackStream = require('webpack-stream');
var webpack = webpackStream.webpack;
var named = require('vinyl-named');
var path = require('path');
var AssetsPlugin = require('assets-webpack-plugin');

var isDevelopment = !process.env.NODE_ENV || process.env.NODE_ENV == 'development';

gulp.task('styles', function() {
  gulp.src('frontend/styles/index.styl')
  .pipe(plumber({errorHandler: notify.on('error', notify.onError(function(err) {
    return {
      title: 'Styles',
      message: err.message
    };
  }))}))
  .pipe(gulpIf(isDevelopment, sourcemaps.init()))
  .pipe(stylus({
    define: {
      url: require('stylus').resolver()
    }
  }))

  .pipe(gulpIf(isDevelopment, sourcemaps.write()))
  .pipe(gulpIf(!isDevelopment, cssnano()))
  .pipe(gulpIf(!isDevelopment, rev()))
  .pipe(gulp.dest('public/styles'))
  .pipe(gulpIf(!isDevelopment, rev.manifest('css.json')))
  .pipe(gulpIf(!isDevelopment, gulp.dest('manifest')))
  .pipe(reload({stream: true}));
});

gulp.task('webpack', function() {
  let options = {
    output:  {
      publicPath: '/js/',
      filename: isDevelopment ? '[name].js' : '[name]-[chunkhash:10].js'
    },
    watch: isDevelopment,
    devtool: isDevelopment ? 'cheap-module-inline-map' : null,
    module: {
      rules: [
        {
          test: /\.js$/,
          include: path.join(__dirname, "frontend"),
          loader: 'babel-loader&presets[]=es2015'
        }
      ]
    },
    plugins: [
      new webpack.NoErrorsPlugin()
    ]
  };

  if (!isDevelopment) {
   options.plugins.push(
       new webpack.optimize.UglifyJsPlugin({
         compress: {
           // don't show unreachable variables etc
           warnings:     false,
           unsafe:       true
         }
       }),
       new AssetsPlugin({
         filename: 'webpack.json',
         path:     __dirname + '/manifest',
         processOutput(assets) {
           for (let key in assets) {
             assets[key + '.js'] = assets[key].js.slice(options.output.publicPath.length);
             delete assets[key];
           }
           return JSON.stringify(assets);
         }
       })
   );

  gulp.src('frontend/js/*.js')
  .pipe(plumber({
    errorHandler: notify.onError(err => ({
      title: 'Webpack',
      message: err.message
    }))
  }))
  .pipe(named())
  .pipe(webpackStream(options))
  .pipe(gulpIf(!isDevelopment, uglify()))
  .pipe(gulp.dest('public/js'))
  .pipe(reload({stream: true}));

};

});

gulp.task('clean', function() {
  del(['public/*.*', '!public']);
});

gulp.task('assets', function() {
  gulp.src('frontend/assets/*.*')
  .pipe(cached('assets'))
  .pipe(newer('./public'))
  .pipe(gulpIf(!isDevelopment, revReplace({
    manifest: gulp.src('manifest/css.json', {allowEmpty: true})
  })))
  .pipe(gulp.dest('./public'));
});

gulp.task('styles:assets', function() {
  gulp.src('frontend/styles/**/*.{svg,png}')
  .pipe(cached('styles:assets'))
  .pipe(newer('./public'))
  .pipe(gulp.dest('./public/styles'));
});

gulp.task('build', run('clean', 'styles:assets', 'styles', 'webpack', 'assets'));

gulp.task('watch', function() {
  gulp.watch('frontend/styles/**/*.styl', ['styles']);
  gulp.watch('frontend/assets/**/*.*', ['assets']);
  gulp.watch('frontend/styles/**/*.{svg,png}', ['styles:assets']);
});

gulp.task('serve', function() {
  browserSync.init({
    server: 'public'
  });

  gulp.watch("./public/**/*.*").on("change", reload);
});

gulp.task('dev', run('build', 'watch', 'serve'));
