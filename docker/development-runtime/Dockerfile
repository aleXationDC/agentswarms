FROM agentswarms/notebook-runtime@sha256:bacda8045e082305ee804de291ed094d36f3320880e5a57c823c2559e934a95a
ARG AXTN_SOURCE_COMMIT
LABEL org.opencontainers.image.revision=$AXTN_SOURCE_COMMIT
USER root
COPY --chmod=0555 entrypoint.sh /usr/local/bin/axtn-development-entrypoint
COPY --chmod=0444 verify.py invoke.py /opt/axtn/
RUN chmod 0755 /opt/axtn
USER 1000:1000
ENTRYPOINT ["/usr/local/bin/axtn-development-entrypoint"]
