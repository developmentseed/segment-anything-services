FROM pytorch/torchserve:latest-gpu
USER root
RUN pip install "git+https://github.com/facebookresearch/segment-anything.git"
COPY ./deployment/dockerd-entrypoint.sh /usr/local/bin/dockerd-entrypoint.sh
RUN chmod +x /usr/local/bin/dockerd-entrypoint.sh
RUN mkdir -p /home/model-server/ && mkdir -p /home/model-server/tmp
COPY ./deployment/config.properties /home/model-server/config.properties
WORKDIR /home/model-server
ENV TEMP=/home/model-server/tmp
ENV ENABLE_TORCH_PROFILER=TRUE
ENTRYPOINT ["/usr/local/bin/dockerd-entrypoint.sh"]
CMD ["serve"]