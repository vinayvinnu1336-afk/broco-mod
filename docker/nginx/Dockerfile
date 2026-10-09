FROM nginx:1.27-alpine

RUN rm -f /etc/nginx/conf.d/default.conf

COPY upstreams.conf shared.conf proxy_params.conf /etc/nginx/
COPY http.conf.template https.conf.template /etc/nginx/templates-available/
COPY 40-select-config.sh /docker-entrypoint.d/40-select-config.sh
RUN sed -i 's/\r$//' /docker-entrypoint.d/40-select-config.sh && chmod +x /docker-entrypoint.d/40-select-config.sh

EXPOSE 80 443

CMD ["nginx", "-g", "daemon off;"]
