
### Small guide
1. Create sites.txt with websites urls (1 string one url, with schema https:// or http://)
1. `cp .env.example .env`, and fill with variables
1. run `docker build --tag 'page-speed-checker' .`
1. to run `docker run --rm  page-speed-checker`


### Statistic of api usage
- [Google console](https://console.cloud.google.com/apis/api/pagespeedonline.googleapis.com/metrics)