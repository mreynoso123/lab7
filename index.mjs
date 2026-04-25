import express from 'express';
import mysql from 'mysql2/promise';
import session from 'express-session';
import bcrypt from 'bcrypt';

const app = express();
app.set('view engine', 'ejs');
app.use(express.static('public'));
//for Express to get values using the POST method
app.use(express.urlencoded({ extended: true }));
//setting up database connection pool, replace values in red
const pool = mysql.createPool({
    host: "m7nj9dclezfq7ax1.cbetxkdyhwsb.us-east-1.rds.amazonaws.com",
    user: "ktnlj1fo3fenphbv",
    password: "t44kxygvg4vpthyr",
    database: "fuk2ymnz7c1m9sbh",
    connectionLimit: 10,
    waitForConnections: true
});

//session middleware for user auth
app.use(session({
  secret: 'secretkey',
  resave: false,
  saveUninitialized: true,
}));

//middleware
app.use((req, res, next) => {
   console.log(req.url);
   next(); //next middleware/route
});

// middleware to check if user is authenticated
function isAuthenticated(req, res, next) {
  if (req.session.adminId) return next();
  res.redirect('/login');
}

//routes
app.get("/", isAuthenticated, (req, res) => {
    res.render('home.ejs');
});

app.get("/login", (req, res) => {
    res.render('login.ejs', { error: null });
});

app.post('/login', async (req, res) => {
    const {username, password} = req.body;
    if(!username || !password) {
        return res.render('login.ejs', {error: 'All fields required!'});
    }

    try{
        const [rows] = await pool.query(
            'SELECT * FROM admin WHERE username = ?', 
            [username]
        );

        if (rows.length == 0) {
            return res.render('login.ejs', {error: 'Invalid username or password.'});
        }

        const admin = rows[0];
        const passwordMatch = await bcrypt.compare(password, admin.password);
        if(!passwordMatch){
            return res.render('login.ejs', {error: 'Invalid username or password'});
        }

        req.session.adminId = admin.adminId;
        req.session.username = admin.username;
        res.redirect('/');
    } catch(err) {
        console.error('Login error:', err);
        res.render('login.ejs', { error: 'Login failed.' });
    }
});

app.get("/authors", async (req, res) => {
    let sql = `SELECT firstName, lastName, authorId 
    FROM authors 
    ORDER BY lastName`;

    const [authors] = await pool.query(sql);
    console.log(authors);
    res.render("authors.ejs", { authors });
});

//Display the form to update an exisiting author
app.get("/updateAuthor", async (req, res) => {
    let authorId = req.query.authorId;
    let sql = `SELECT *, DATE_FORMAT(dob, '%Y-%m-%d') ISOdob, DATE_FORMAT(dod, '%Y-%m-%d') ISOdod
    FROM authors 
    WHERE authorId = ?`;
    const [authorInfo] = await pool.query(sql, [authorId]);
    res.render("updateAuthor.ejs", { authorInfo });
});

app.post("/updateAuthor", async (req, res) => {
    let firstName = req.body.firstName;
    let lastName = req.body.lastName;
    let dob = req.body.dob;
    let sex = req.body.sex;
    let authorId = req.body.authorId;
    
    let sql = `UPDATE authors
                SET
                firstName = ?,
                lastName = ?, 
                dob = ?,
                sex = ?
                WHERE authorId = ?
                `;

    let sqlParams = [firstName, lastName, dob, sex, authorId];
    const [rows] = await pool.query(sql, sqlParams);
    res.redirect('/authors');
});

app.get("/deleteAuthor", async (req, res) => {
    let authorId = req.query.authorId;
    let sql = `SELECT *, DATE_FORMAT(dob, '%Y-%m-%d') ISOdob, DATE_FORMAT(dod, '%Y-%m-%d') ISOdod
    FROM authors 
    WHERE authorId = ?`;
    const [authorInfo] = await pool.query(sql, [authorId]);
    res.render("deleteAuthor.ejs", { authorInfo });
});

app.post("/deleteAuthor", async (req, res) => {
    let authorId = req.body.authorId;
    
    let sql = `DELETE FROM authors WHERE authorId = ?`;

    let sqlParams = [authorId];
    const [rows] = await pool.query(sql, sqlParams);
    res.redirect('/authors');
});

app.get("/quotes", async (req, res) => {
    let sql = `SELECT quote, quoteId 
    FROM quotes 
    ORDER BY quote`;

    const [quotes] = await pool.query(sql);
    console.log(quotes);
    res.render("quotes.ejs", { quotes });
});

//Displays the form we just made
app.get("/updateQuote", async (req, res) => {
    //Getting the id of the quote that will prepoulate teh update form
    let quoteId = req.query.quoteId;
    //select the data for the one specific quote we're updating
    //so it can be plugged into the form
    let sql = `SELECT * 
    FROM quotes 
    WHERE quoteId = ?`;
    const [quoteInfo] = await pool.query(sql, [quoteId]);
    console.log(quoteInfo);

    //get the list of full authors for the dropdown list
    //in the update quote form
    let authorsSql = `SELECT authorId, firstName, lastName 
    FROM authors`;
    const[authorsList] = await pool.query(authorsSql);

    let categoriesSql = `SELECT DISTINCT category FROM quotes`;
    const[categoriesList] = await pool.query(categoriesSql);

    res.render("updateQuote.ejs", { quoteInfo, authorsList, categoriesList });
});

app.post("/updateQuote", async (req, res) => {
    let quoteId = req.body.quoteId;
    let authorId = req.body.authorId;
    let category = req.body.category;
    let quote = req.body.quote;
    
    let sql = `UPDATE quotes
                SET
                quote = ?, 
                authorId = ?,
                category = ?
                WHERE quoteId = ?
                `;

    let sqlParams = [quote, authorId, category, quoteId];
    const [rows] = await pool.query(sql, sqlParams);
    res.redirect('/quotes');
});

//renders the new quote form
app.get("/newQuote", async (req, res) => {
    res.render("newQuote.ejs");
});

//saves a new quote to the database
app.post("/newQuote", async (req, res) => {
    let quote = req.body.quote;
    let authorId = req.body.authorId;
    let category = req.body.category;
    
    const params = [quote, authorId, category];
    const [rows] = await pool.query("INSERT INTO quotes (quote, authorId, category) VALUES (?, ?, ?)", params);

    res.redirect("/");
});

app.get("/newAuthor", (req, res) => {
    res.render("newAuthor.ejs");
});

app.post("/newAuthor", async (req, res) => {
    let firstName = req.body.firstName;
    let lastName = req.body.lastName;
    let dob = req.body.dob;
    let dod = req.body.dod;
    let sex = req.body.sex;
    let profession = req.body.profession;
    let country = req.body.country;
    let portrait = req.body.portrait;
    let biography = req.body.biography;

    const params = [firstName, lastName, dob, dod, sex, profession, country, portrait, biography];

    const [rows] = await pool.query("INSERT INTO authors (firstName, lastName, dob, dod,sex, profession, country, portrait, biography) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)", params);

    res.redirect("/");
});

app.get("/dbTest", async (req, res) => {
    try {
        const [rows] = await pool.query("SELECT CURDATE()");
        res.send(rows);
    } catch (err) {
        console.error("Database error:", err);
        res.status(500).send("Database error!");
    }
});//dbTest

app.listen(3000, () => {
    console.log("Express server running")
})
