- To release a new version of ipyspeck on PyPI:

Update _version.py
git add the _version.py file and git commit

`python setup.py sdist bdist_wheel`
`twine upload dist/ipyspeck-X.X.X*`
`git tag -a X.X.X -m 'comment'`

git push
git push --tags

- To release a new version of ipyspeck on NPM:

Update `js/package.json` with new npm package version

```
# clean out the `dist` and `node_modules` directories
git clean -fdx
npm install
npm publish
```
