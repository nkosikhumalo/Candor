FROM eclipse-temurin:21-jdk AS build

WORKDIR /workspace

COPY .mvn/ .mvn/
COPY mvnw pom.xml ./
COPY src/ src/

RUN chmod +x mvnw && ./mvnw -B -DskipTests package

# The checked-in RAG snapshot is a prebuilt policy corpus, but it can also
# contain local conversation history. Keep the corpus and strip chat data
# from every image so local sessions are never seeded into production.
FROM python:3.12-slim AS rag-db
WORKDIR /data
ARG RAG_DB_FILE=data/rag.db
COPY ${RAG_DB_FILE} /data/rag.db
RUN python -c "import sqlite3; db=sqlite3.connect('/data/rag.db'); db.execute('DELETE FROM conversation_messages'); db.commit(); db.close()"

FROM eclipse-temurin:21-jre

WORKDIR /app

RUN mkdir -p /app/data && chown 10001:10001 /app/data
COPY --from=rag-db --chown=10001:10001 /data/rag.db /app/data/rag.db
COPY --from=build --chown=10001:10001 /workspace/target/companion-backend-0.1.0.jar /app/app.jar

ENV RAG_DB_PATH=/app/data/rag.db
# Render injects PORT=10000 for web services. Locally, Spring falls back to
# SERVER_PORT=8080 when PORT is not set.
EXPOSE 10000
USER 10001:10001

ENTRYPOINT ["java", "-jar", "/app/app.jar"]
