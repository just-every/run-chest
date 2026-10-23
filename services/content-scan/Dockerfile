FROM debian:trixie-slim
RUN apt-get update && apt-get install -y --no-install-recommends python3 clamav clamav-freshclam ca-certificates && rm -rf /var/lib/apt/lists
WORKDIR /opt/chest-scanner
COPY --chmod=644 server.py entrypoint.py freshclam.conf ./
RUN useradd --system --create-home chestscan && chown -R chestscan /var/lib/clamav
USER chestscan
EXPOSE 8095
ENTRYPOINT ["python3", "entrypoint.py"]
