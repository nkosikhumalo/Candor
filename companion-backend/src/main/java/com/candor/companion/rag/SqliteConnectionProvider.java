package com.candor.companion.rag;

import org.springframework.stereotype.Component;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;
import java.sql.Statement;

/**
 * Raw JDBC connection to the SQLite file, kept independent of this
 * project's main DataSource (which may already be configured for a
 * different store, e.g. Postgres for profiles/sessions) so wiring this
 * module in doesn't touch unrelated configuration.
 *
 * Requires the sqlite-jdbc driver on the classpath — see this module's
 * README for the pom.xml dependency to add.
 */
@Component
public class SqliteConnectionProvider {

    private final RagProperties props;

    public SqliteConnectionProvider(RagProperties props) {
        this.props = props;
    }

    public Connection getConnection() throws SQLException {
        Connection connection = DriverManager.getConnection("jdbc:sqlite:" + props.getDbPath());
        try (Statement statement = connection.createStatement()) {
            // Requests and chat-history writes share this SQLite file. Let a
            // concurrent writer finish instead of surfacing SQLITE_BUSY as HTTP 500.
            statement.execute("PRAGMA busy_timeout = 10000");
            return connection;
        } catch (SQLException error) {
            connection.close();
            throw error;
        }
    }
}
