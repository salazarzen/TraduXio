TraduXio – A participative platform for cultural texts translators
==================================================================

License: [GNU Affero General Public License](http://www.gnu.org/licenses/agpl.html)
Contact: aurelien.benel@utt.fr

Installation requirements
-------------------------

* Git client
* [CouchDB](http://couchdb.apache.org/)
* [Couchapp](https://github.com/jchris/couchapp)
* [Node.js](http://nodejs.org)

Installation procedure
----------------------

* Create a database named `traduxio` at <http://127.0.0.1:5984/_utils>.
* In any folder:

        git clone https://github.com/benel/TraduXio.git
        cd TraduXio
        couchapp push --browse couchdb http://127.0.0.1:5984/traduxio


Using docker compose
--------------------

You can run the application by using docker containers. The compose.yml file allows to run everything. What needs to be setup first is :

- Admin password necessary to manipulate users in `couchdb-admin.env`, `couchdh/.couchaprc` and `node/node_config.json`
- domain name for the installation, in `couchdb-custom.ini` and `node/node_config.json`
- email server to send notification emails in `node/node_config.json`

This procedure doesn't handle ssl configuration for https traffic, you need to either set it up separately, or use an exsting reverse proxy.

Installation on a server
------------------------

1. Clone the repository:

        git clone https://github.com/benel/TraduXio.git
        cd TraduXio

2. Create the four configuration files from their templates. They are not in the
   repository because they hold credentials:

        cp couchdb-admin.env.default couchdb-admin.env
        cp couchdb/sample.couchapprc couchdb/.couchapprc
        cp node/node_config.example.json node/node_config.json
        printf 'your-strong-password' > couchdb-admin-password

   `couchdb-admin-password` is the docker secret referenced by `compose.yml`; it
   must exist or the stack won't start, and must be written without a trailing
   newline. Choose one admin username and password and use the same in all
   three: `COUCHDB_USER`/`COUCHDB_PASSWORD` in `couchdb-admin.env`, the
   connection URL in `couchdb/.couchapprc`, and
   `admin_username`/`admin_password` in `node/node_config.json`.

3. Create the directories that will hold the CouchDB data, then declare them in
   the `volumes:` section at the end of `compose.yml`. The `device` paths must
   be **absolute** and must already exist, otherwise the container fails to
   start:

        mkdir -p /home/rancher/traduxio/{etc,log,lib}

        couch-data:
          driver: local
          driver_opts:
            type: 'none'
            o: 'bind'
            device: '/home/rancher/traduxio/lib/'

   with `/home/rancher/traduxio/etc/` for `couch-etc` and
   `/home/rancher/traduxio/log/` for `couch-log`.

4. If port 5984 is already used on the machine, change only the published side
   in the `couchdb` service, e.g. `- 5986:5984`. The port inside the compose
   network stays 5984, so `database` in `node_config.json` and the URL in
   `.couchapprc` are unchanged; the new port must however be reported in
   `base_url` and in the default database URL of `deploy.sh`.

5. Set the domain in `couchdb-custom.ini`, replacing the `traduxio.domain.cdn`
   vhost entry, and in `node/node_config.json` adapt:

   - `base_url` — the public URL of the works, as it will appear in the emails
     sent to the users, e.g. `https://traduxio.example.org/works/`.
   - `salt` — a random string, used to derive the email confirmation keys.
   - `email_host`, `email_port`, `email_ssl`, `email_user`, `email_password` —
     the SMTP account of the platform. `email_port` and `email_ssl` are needed
     for providers using implicit TLS (port 465); without them the connection
     falls back to port 587 without SSL.
   - `email_sender` — the `From:` address of the messages.
   - `email_receiver` — the address of the platform administrator, who receives
     the registration and copyright notifications.
   - `send` — `true` to actually send the emails. With `false` they are only
     printed in the container log and new users never get the `confirmed` role.

   `server_url` and `port` (1337) concern `node/node_server.js`, which is not
   started by `compose.yml`, and can be left as they are.

6. Launch:

        docker compose up -d

   The `couchapp` container exits once the design document is pushed, which is
   expected. The application is then served at
   `http://your-server:5984/traduxio/_design/traduxio/_rewrite/`, or at the root
   of the domain declared in `couchdb-custom.ini`.

Note that CouchDB is exposed directly, without SSL, and that its admin interface
is publicly reachable at `/_utils`. Put a reverse proxy in front of it to serve
the site over HTTPS and to restrict that interface.

Tests requirements (The sections below are deprecated)
------------------

* Ruby

Note: If you're on MacOS X, [change your `PATH`](http://stackoverflow.com/a/14138490/1121345) so that `gem` refers to brew's gem rather than to system's.

Tests installation procedure
---------------------------

* In any folder:

        sudo gem install capybara poltergeist rspec

Tests running
-------------

* In the application folder:

        rspec spec/features/* [--order random]
