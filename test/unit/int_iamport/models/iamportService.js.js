const chai = require('chai');
const chaiHttp = require('chai-http');
const app = require('../../../mocks/scripts/service/iamportService');
chai.use(chaiHttp);
const expect = chai.expect;


describe('Users API test', () => {
	it('should return 200 status code', (done) => {
	    chai.request(app)
	        .get('/')
	        .end((err, res) => {
	            expect(res).to.have.status(200);
	            done();
	        });
	});
});


describe('Authentication API' , () => {
	it('should return a token when provided with valid credentials', (done) => {
	    chai.request(app)
	        .post('/api/auth/token')
			.send({ username: 'testuser', password: 'correctpassword' })
	        .end((err, res) => {
				expect(res).to.have.status(200);
	            expect(res.body).to.have.property('token');
	            done();
	        });
	});

	it('should return an error when provided with invalid credentials', (done) => {
		chai.request(app)
		  .post('/api/auth/token')
		  .send({ username: 'testuser', password: 'incorrectpassword' })
		  .end((err, res) => {
			expect(res).to.have.status(401);
			expect(res.body).to.have.property('error');
			done();
		  });
	});
});


describe('Test REST paymentInfo API with authentication', () => {
	let token;
	before(done => {
	  // Log in to get the JWT token
		chai.request(app)
			.post('/api/auth/token')
			.send({ username: 'testuser', password: 'correctpassword' })
			.end((err, res) => {
			  expect(res).to.have.status(200);
			  token = res.body.token;
			  done();
			});
	});

	it('should return a 201 status code for get request to /iamport_getPaymentInfo with a valid JWT', (done) => {
		// get iamport uid from success payment.
	  	chai.request(app)
			.get('/api/iamport_getPaymentInfo/')
			.set('Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ0ZXN0dXNlciIsImlhdCI6MTY3NjI3MzQzMCwiZXhwIjoxNjc2Mjc3MDMwfQ.j_cZX5EsjpvwoeJINN80bheuAxO7dVAbSlTZT-pG66')
			.query({impuid : 'imp_566377906932'})
			.end((err, res) => {
			 	expect(res).to.have.status(200);
			 	done();
			});
	});

});
